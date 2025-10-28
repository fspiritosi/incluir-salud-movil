2.4. Installing, Upgrading Tiger Geocoder, and loading data
2.4.1. Tiger Geocoder Enabling your PostGIS database
2.4.2. Using Address Standardizer Extension with Tiger geocoder
2.4.3. Required tools for tiger data loading
2.4.4. Upgrading your Tiger Geocoder Install and Data
Extras like Tiger geocoder may not be packaged in your PostGIS distribution. If you are missing the tiger geocoder extension or want a newer version than what your install comes with, then use the share/extension/postgis_tiger_geocoder.* files from the packages in Windows Unreleased Versions section for your version of PostgreSQL. Although these packages are for windows, the postgis_tiger_geocoder extension files will work on any OS since the extension is an SQL/plpgsql only extension.

2.4.1. Tiger Geocoder Enabling your PostGIS database
These directions assume your PostgreSQL installation already has the postgis_tiger_geocoder extension installed.

Connect to your database via psql or pgAdmin or some other tool and run the following SQL commands. Note that if you are installing in a database that already has postgis, you don't need to do the first step. If you have fuzzystrmatch extension already installed, you don't need to do the second step either.

CREATE EXTENSION postgis;
CREATE EXTENSION fuzzystrmatch;
CREATE EXTENSION postgis_tiger_geocoder;
--this one is optional if you want to use the rules based standardizer (pagc_normalize_address)
CREATE EXTENSION address_standardizer;
If you already have postgis_tiger_geocoder extension installed, and just want to update to the latest run:

ALTER EXTENSION postgis UPDATE;
ALTER EXTENSION postgis_tiger_geocoder UPDATE;
If you made custom entries or changes to tiger.loader_platform and tiger.loader_variables you may need to update these.

To confirm your install is working correctly, run this sql in your database:

SELECT na.address, na.streetname,na.streettypeabbrev, na.zip
	FROM normalize_address('1 Devonshire Place, Boston, MA 02109') AS na;
Which should output

 address | streetname | streettypeabbrev |  zip
---------+------------+------------------+-------
	   1 | Devonshire | Pl               | 02109
Create a new record in tiger.loader_platform table with the paths of your executables and server.

So for example to create a profile called debbie that follows sh convention. You would do:

INSERT INTO tiger.loader_platform(os, declare_sect, pgbin, wget, unzip_command, psql, path_sep,
		   loader, environ_set_command, county_process_command)
SELECT 'debbie', declare_sect, pgbin, wget, unzip_command, psql, path_sep,
	   loader, environ_set_command, county_process_command
  FROM tiger.loader_platform
  WHERE os = 'sh';
And then edit the paths in the declare_sect column to those that fit Debbie's pg, unzip,shp2pgsql, psql, etc path locations.

If you don't edit this loader_platform table, it will just contain common case locations of items and you'll have to edit the generated script after the script is generated.

As of PostGIS 2.4.1 the Zip code-5 digit tabulation area zcta5 load step was revised to load current zcta5 data and is part of the Loader_Generate_Nation_Script when enabled. It is turned off by default because it takes quite a bit of time to load (20 to 60 minutes), takes up quite a bit of disk space, and is not used that often.

To enable it, do the following:

UPDATE tiger.loader_lookuptables SET load = true WHERE table_name = 'zcta520';
If present the Geocode function can use it if a boundary filter is added to limit to just zips in that boundary. The Reverse_Geocode function uses it if the returned address is missing a zip, which often happens with highway reverse geocoding.

Create a folder called gisdata on root of server or your local pc if you have a fast network connection to the server. This folder is where the tiger files will be downloaded to and processed. If you are not happy with having the folder on the root of the server, or simply want to change to a different folder for staging, then edit the field staging_fold in the tiger.loader_variables table.

Create a folder called temp in the gisdata folder or wherever you designated the staging_fold to be. This will be the folder where the loader extracts the downloaded tiger data.

Then run the Loader_Generate_Nation_Script SQL function make sure to use the name of your custom profile and copy the script to a .sh or .bat file. So for example to build the nation load:

psql -c "SELECT Loader_Generate_Nation_Script('debbie')" -d geocoder -tA > /gisdata/nation_script_load.sh
Run the generated nation load commandline scripts.

cd /gisdata
sh nation_script_load.sh
After you are done running the nation script, you should have three tables in your tiger_data schema and they should be filled with data. Confirm you do by doing the following queries from psql or pgAdmin

SELECT count(*) FROM tiger_data.county_all;
 count
-------
  3235
(1 row)
SELECT count(*) FROM tiger_data.state_all;
 count
-------
    56
(1 row)
This will only have data if you marked zcta5 to be loaded

SELECT count(*) FROM tiger_data.zcta5_all;
 count
-------
  33931
(1 row)
By default the tables corresponding to bg, tract, tabblock20 are not loaded. These tables are not used by the geocoder but are used by folks for population statistics. If you wish to load them as part of your state loads, run the following statement to enable them.

UPDATE tiger.loader_lookuptables SET load = true WHERE load = false AND lookup_name IN('tract', 'bg', 'tabblock20');
Alternatively you can load just these tables after loading state data using the Loader_Generate_Census_Script

For each state you want to load data for, generate a state script Loader_Generate_Script.

[Warning]	
DO NOT Generate the state script until you have already loaded the nation data, because the state script utilizes county list loaded by nation script.

psql -c "SELECT Loader_Generate_Script(ARRAY['MA'], 'debbie')" -d geocoder -tA > /gisdata/ma_load.sh
Run the generated commandline scripts.

cd /gisdata
sh ma_load.sh
After you are done loading all data or at a stopping point, it's a good idea to analyze all the tiger tables to update the stats (include inherited stats)

SELECT install_missing_indexes();
vacuum (analyze, verbose) tiger.addr;
vacuum (analyze, verbose) tiger.edges;
vacuum (analyze, verbose) tiger.faces;
vacuum (analyze, verbose) tiger.featnames;
vacuum (analyze, verbose) tiger.place;
vacuum (analyze, verbose) tiger.cousub;
vacuum (analyze, verbose) tiger.county;
vacuum (analyze, verbose) tiger.state;
vacuum (analyze, verbose) tiger.zcta5;
vacuum (analyze, verbose) tiger.zip_lookup_base;
vacuum (analyze, verbose) tiger.zip_state;
vacuum (analyze, verbose) tiger.zip_state_loc;
2.4.2. Using Address Standardizer Extension with Tiger geocoder
One of the many complaints of folks is the address normalizer function Normalize_Address function that normalizes an address for prepping before geocoding. The normalizer is far from perfect and trying to patch its imperfectness takes a vast amount of resources. As such we have integrated with another project that has a much better address standardizer engine. To use this new address_standardizer, you compile the extension as described in Section 2.3, “Installing and Using the address standardizer” and install as an extension in your database.

Once you install this extension in the same database as you have installed postgis_tiger_geocoder, then the Pagc_Normalize_Address can be used instead of Normalize_Address. This extension is tiger agnostic, so can be used with other data sources such as international addresses. The tiger geocoder extension does come packaged with its own custom versions of rules table ( tiger.pagc_rules) , gaz table (tiger.pagc_gaz), and lex table (tiger.pagc_lex). These you can add and update to improve your standardizing experience for your own needs.

2.4.3. Required tools for tiger data loading
The load process downloads data from the census website for the respective nation files, states requested, extracts the files, and then loads each state into its own separate set of state tables. Each state table inherits from the tables defined in tiger schema so that its sufficient to just query those tables to access all the data and drop a set of state tables at any time using the Drop_State_Tables_Generate_Script if you need to reload a state or just don't need a state anymore.

In order to be able to load data you'll need the following tools:

A tool to unzip the zip files from census website.

For Unix like systems: unzip executable which is usually already installed on most Unix like platforms.

For Windows, 7-zip which is a free compress/uncompress tool you can download from http://www.7-zip.org/

shp2pgsql commandline which is installed by default when you install PostGIS.

wget which is a web grabber tool usually installed on most Unix/Linux systems.

If you are on windows, you can get pre-compiled binaries from http://gnuwin32.sourceforge.net/packages/wget.htm

If you are upgrading from tiger_2010, you'll need to first generate and run Drop_Nation_Tables_Generate_Script. Before you load any state data, you need to load the nation wide data which you do with Loader_Generate_Nation_Script. Which will generate a loader script for you. Loader_Generate_Nation_Script is a one-time step that should be done for upgrading (from a prior year tiger census data) and for new installs.

To load state data refer to Loader_Generate_Script to generate a data load script for your platform for the states you desire. Note that you can install these piecemeal. You don't have to load all the states you want all at once. You can load them as you need them.

After the states you desire have been loaded, make sure to run the:

SELECT install_missing_indexes();
as described in Install_Missing_Indexes.

To test that things are working as they should, try to run a geocode on an address in your state using Geocode

2.4.4. Upgrading your Tiger Geocoder Install and Data
First upgrade your postgis_tiger_geocoder extension as follows:

ALTER EXTENSION postgis_tiger_geocoder UPDATE;
Next drop all nation tables and load up the new ones. Generate a drop script with this SQL statement as detailed in Drop_Nation_Tables_Generate_Script

SELECT drop_nation_tables_generate_script();
Run the generated drop SQL statements.

Generate a nation load script with this SELECT statement as detailed in Loader_Generate_Nation_Script

For windows

SELECT loader_generate_nation_script('windows'); 
For unix/linux

SELECT loader_generate_nation_script('sh');